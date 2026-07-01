import json
import os
import re

POSTMAN_FILE = r"D:\mutrapro_system_testing\postman\Presentation.postman_collection.json"
OUTPUT_DIR = r"d:\mutrapro_system_testing\services\order-service\tests\unit\auto-generated"

# Tạo thư mục output nếu chưa có
os.makedirs(OUTPUT_DIR, exist_ok=True)

def slugify(value):
    """Chuyển tên thư mục thành tên file an toàn."""
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[\s_-]+', '-', value)

def parse_url(raw_url):
    """Lấy endpoint path từ Postman URL."""
    # VD: {{order-service-url}}/
    url = raw_url.replace('{{order-service-url}}', '')
    if not url.startswith('/'):
        url = '/' + url
    return url

def extract_body(request):
    """Lấy JSON body nếu có."""
    if 'body' in request and request['body'].get('mode') == 'raw':
        try:
            raw = request['body'].get('raw', '{}')
            # Cố gắng loại bỏ các biến {{...}} để tránh lỗi JSON parse
            raw = re.sub(r'\{\{[^\}]+\}\}', '"MOCK_VAR"', raw)
            return json.loads(raw)
        except:
            return None
    return None

def generate_test_file(folder_name, requests):
    if not requests:
        return
    
    file_name = f"{slugify(folder_name)}.test.js"
    file_path = os.path.join(OUTPUT_DIR, file_name)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write("const request = require('supertest');\n")
        f.write("const app = require('../../../index');\n\n")
        
        # Escape single quotes in describe
        safe_folder = folder_name.replace("'", "\\'")
        f.write(f"describe('Auto-Generated: {safe_folder}', () => {{\n")
        f.write("    beforeEach(() => {\n")
        f.write("        jest.clearAllMocks();\n")
        f.write("    });\n\n")
        
        for req in requests:
            req_name = req['name'].replace("'", "\\'")
            method = req['request']['method'].lower()
            url = parse_url(req['request']['url']['raw'])
            body = extract_body(req['request'])
            
            f.write(f"    it('{req_name}', async () => {{\n")
            f.write("        // TODO: Chỉnh sửa Mock DB nếu cần\n")
            f.write("        // global.mockPool.execute.mockResolvedValueOnce([[{}]]);\n\n")
            
            if body:
                body_str = json.dumps(body, indent=12).replace('\n', '\n        ')
                f.write(f"        const payload = {body_str};\n\n")
                f.write(f"        const response = await request(app)\n")
                f.write(f"            .{method}('{url}')\n")
                f.write(f"            .send(payload);\n\n")
            else:
                f.write(f"        const response = await request(app)\n")
                f.write(f"            .{method}('{url}');\n\n")
            
            f.write("        // TODO: Xác định mã lỗi kỳ vọng (Ví dụ 200, 201, 400)\n")
            f.write("        expect(response.status).toBeDefined();\n")
            f.write("    });\n\n")
            
        f.write("});\n")
    # print(f"Generated {file_name} with {len(requests)} tests.")

# Đọc file JSON
with open(POSTMAN_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Phân tích đệ quy để gom nhóm
def process_items(items, current_folder="Root"):
    for item in items:
        if 'item' in item: # Đây là 1 thư mục
            folder_name = item['name']
            # Tìm tất cả các Request trực tiếp bên trong thư mục này
            reqs = [child for child in item['item'] if 'request' in child]
            if reqs:
                generate_test_file(folder_name, reqs)
            # Đi sâu vào thư mục con nếu có
            process_items(item['item'], folder_name)

api_folder = next((item for item in data['item'] if item['name'].lower() == 'api'), None)
if api_folder and 'item' in api_folder:
    order_folder = next((item for item in api_folder['item'] if 'order' in item['name'].lower()), None)
    if order_folder and 'item' in order_folder:
        process_items(order_folder['item'])
