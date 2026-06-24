const fs = require('fs');
const file = 'postman/Presentation.postman_collection.json';
let content = fs.readFileSync(file, 'utf8');

// Replace all git conflict markers with the HEAD version
content = content.replace(/<<<<<<< HEAD\r?\n(.*?)\r?\n=======\r?\n(.*?)\r?\n>>>>>>> [a-f0-9]+\r?\n/g, '$1\n');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed all merge conflicts.');
