const fs = require('fs');
const path = require('path');

const structure = {
  'backend': {
    'src': {
      'config': {},
      'controllers': {},
      'models': {},
      'routes': {},
      'middleware': {},
      'utils': {},
      'server.js': ''
    },
    '.env': '',
    'package.json': ''
  },
  'frontend': {
    'public': {},
    'src': {
      'components': {},
      'pages': {},
      'hooks': {},
      'context': {},
      'services': {},
      'styles': {},
      'App.jsx': '',
      'main.jsx': ''
    },
    'package.json': '',
    'vite.config.js': ''
  },
  'docs': {},
  '.gitignore': '',
  'README.md': '',
  'package.json': ''
};

function createStructure(basePath, obj) {
  for (let key in obj) {
    const newPath = path.join(basePath, key);
    if (typeof obj[key] === 'object') {
      fs.mkdirSync(newPath, { recursive: true });
      createStructure(newPath, obj[key]);
    } else {
      fs.writeFileSync(newPath, obj[key]);
    }
  }
}

createStructure(process.cwd(), structure);
console.log('Project structure created successfully!');
