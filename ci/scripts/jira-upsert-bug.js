const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { detectService } = require('./detect-service');
const { classifyError, determinePriority } = require('./classify-error');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'KAN';
const ISSUE_KEY = process.env.ISSUE_KEY; // PR issue key if any
const GITHUB_ACTOR = process.env.GITHUB_ACTOR || 'unknown-actor';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'unknown-branch';
const GITHUB_SHA = process.env.GITHUB_SHA || 'unknown-commit';
const GITHUB_RUN_URL = process.env.GITHUB_RUN_URL || 'unknown-url';
const EVENT_NAME = process.env.EVENT_NAME || 'unknown-event';

const REPORT_PATH = path.join(__dirname, '..', '..', 'newman-results', 'newman-report.json');
const OWNERS_PATH = path.join(__dirname, '..', 'service-owners.yml');

function getAuthHeader() {
  return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
}

async function addJiraComment(issueKey, text) {
  if (!issueKey) return;
  console.log(`Adding comment to Jira issue ${issueKey}...`);
  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text }] }
          ]
        }
      })
    });
    if (!response.ok) {
      console.error(`Failed to add comment to ${issueKey}: ${response.status} ${response.statusText}`);
    } else {
      console.log(`Successfully added comment to ${issueKey}.`);
    }
  } catch (error) {
    console.error('Error adding Jira comment:', error);
  }
}

function buildBugSignature(service, failure, errorType) {
  // Use a hash of service + errorType + request name
  const requestName = failure.source?.name || 'Unknown Request';
  const str = `${service}|${errorType}|${requestName}`;
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 6);
  return `sig-${hash}`;
}

async function searchJiraIssueBySignature(signature) {
  const jql = `project = ${JIRA_PROJECT_KEY} AND labels = ci-failed AND labels = ${signature} AND statusCategory != Done`;
  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.issues && data.issues.length > 0) {
        return data.issues[0]; // Return the first open issue found
      }
    }
  } catch (err) {
    console.error('Error searching Jira issues:', err);
  }
  return null;
}

async function createJiraBug({ service, ownerInfo, errorType, priority, failures, signature }) {
  console.log(`Creating Bug for ${service} (${signature})...`);
  const bugCount = failures.length;
  const mainFailure = failures[0];
  
  const summary = `[${service}-${ownerInfo.owner_name}][${errorType}][${priority}] CI Newman test failed for ${mainFailure.source?.name || 'API'}`;
  
  let failureDetailsText = failures.map(f => `- ${f.source?.name || 'Unknown'}: ${f.error?.message || 'Error'}`).join('\n').substring(0, 5000);
  
  const descriptionText = `
*CI Phát hiện lỗi tự động*

*1. Thông tin chung*
- Service bị ảnh hưởng: ${service}
- Người phụ trách chính: ${ownerInfo.owner_name} (@${ownerInfo.github_username})
- Loại lỗi: ${errorType}
- Priority: ${priority}
- Branch: ${GITHUB_BRANCH}
- Commit: ${GITHUB_SHA}
- Người push code: ${GITHUB_ACTOR}
- Workflow run: ${GITHUB_RUN_URL}

*2. Chi tiết lỗi (${bugCount} requests fail)*
${failureDetailsText}

*3. Đề xuất kiểm tra*
- Vui lòng chạy lại Postman ở local.
- Kiểm tra log service ${service}.
- Bug Signature: ${signature}
`;

  const payload = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: summary,
      description: {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", content: [{ type: "text", text: descriptionText }] }
        ]
      },
      issuetype: { name: "Bug" },
      labels: ["ci-failed", "auto-created", "newman", "github-actions", service, errorType.toLowerCase().replace(/\s+/g, '-'), signature],
    }
  };

  // Add assignee if available
  if (ownerInfo.jira_account_id) {
    payload.fields.assignee = { id: ownerInfo.jira_account_id };
  }

  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error(`Failed to create bug for ${service}: ${response.status} ${response.statusText}`);
      console.error(await response.text());
    } else {
      const data = await response.json();
      console.log(`Successfully created bug ${data.key} for ${service}`);
    }
  } catch (error) {
    console.error(`Error creating Jira bug for ${service}:`, error);
  }
}

async function main() {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.warn("Jira credentials not provided. Skipping Jira integration.");
    return;
  }

  if (!fs.existsSync(REPORT_PATH)) {
    console.warn('Newman report not found at', REPORT_PATH);
    return;
  }
  
  let reportData;
  try {
    reportData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse Newman report:', e);
    return;
  }

  const failures = reportData.run?.failures || [];

  if (failures.length === 0) {
    console.log('No failures found in Newman report. CI Passed.');
    const comment = `CI PASSED: GitHub Actions completed Newman API tests successfully. Branch: ${GITHUB_BRANCH}. Commit: ${GITHUB_SHA}. Run: ${GITHUB_RUN_URL}`;
    await addJiraComment(ISSUE_KEY, comment);
    return;
  }

  // Load owners
  let ownersMap = {};
  if (fs.existsSync(OWNERS_PATH)) {
    try {
      ownersMap = yaml.load(fs.readFileSync(OWNERS_PATH, 'utf8'));
    } catch (e) {
      console.error("Error loading service-owners.yml:", e);
    }
  }

  // Group failures by service
  const grouped = {};
  for (const failure of failures) {
    const service = detectService(failure);
    if (!grouped[service]) grouped[service] = [];
    grouped[service].push(failure);
  }

  for (const [service, serviceFailures] of Object.entries(grouped)) {
    const errorType = classifyError(serviceFailures[0]);
    const priority = determinePriority(service, errorType, serviceFailures[0].error?.message);
    const signature = buildBugSignature(service, serviceFailures[0], errorType);
    
    const ownerInfo = ownersMap[service] || {
      owner_name: 'Unknown',
      github_username: 'unknown',
      jira_account_id: null
    };

    const existingIssue = await searchJiraIssueBySignature(signature);

    if (existingIssue) {
      console.log(`Found existing open bug ${existingIssue.key} for signature ${signature}. Adding comment instead of creating new bug.`);
      const comment = `Lỗi này lại xuất hiện trên CI!
- Branch: ${GITHUB_BRANCH}
- Commit: ${GITHUB_SHA}
- Run: ${GITHUB_RUN_URL}
- ${serviceFailures.length} request(s) failed.`;
      await addJiraComment(existingIssue.key, comment);
    } else {
      await createJiraBug({ service, ownerInfo, errorType, priority, failures: serviceFailures, signature });
    }
  }

  // Also comment on the original PR issue if applicable
  if (ISSUE_KEY) {
    const comment = `CI FAILED: GitHub Actions phát hiện lỗi Newman tests. Branch: ${GITHUB_BRANCH}. Commit: ${GITHUB_SHA}. Run: ${GITHUB_RUN_URL}`;
    await addJiraComment(ISSUE_KEY, comment);
  }
}

main();
