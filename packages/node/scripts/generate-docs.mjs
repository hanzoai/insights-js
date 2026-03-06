import path from 'path'
import fs from 'fs'
import { generateApiSpecs } from '../../../scripts/docs/parser.js'
import { HOG_REF } from '../../../scripts/docs/constants.js'

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

// Node-specific configuration
const NODE_SPEC_INFO = {
  id: 'insights-node',
  title: 'Insights Node.js SDK',
  description:
    'Insights Node.js SDK allows you to capture events and send them to Insights from your Node.js applications.',
  slugPrefix: 'insights-node',
  specUrl: 'https://github.com/Insights/@hanzo/insights',
}

// Node-specific type examples (can be customized as needed)
const NODE_TYPE_EXAMPLES = {
  Properties: `// Properties for Node.js events
{
    event: 'user_signed_up',
    userId: 'user123',
    timestamp: new Date().toISOString(),
    distinct_id: 'user123',
    $set: {
        email: 'user@example.com',
        name: 'John Doe'
    }
}`,
  Property: `// Node.js property value
"user@example.com" | { name: "John", age: 25 }`,
}

const __dirname = import.meta.dirname

const config = {
  packageDir: path.resolve(import.meta.dirname, '..'), // packages/node
  apiJsonPath: path.resolve(import.meta.dirname, '../docs/insights-node.api.json'),
  outputPath: path.resolve(import.meta.dirname, `../references/insights-node-references-${version}.json`),
  version: version,
  id: NODE_SPEC_INFO.id,
  hogRef: HOG_REF,
  specInfo: NODE_SPEC_INFO,
  typeExamples: NODE_TYPE_EXAMPLES,
  parentClass: 'Insights',
}

// Ensure references directory exists
const referencesDir = path.resolve(__dirname, '../references');
if (!fs.existsSync(referencesDir)) {
    fs.mkdirSync(referencesDir, { recursive: true });
}

// Generate versioned file
const output = generateApiSpecs(config)

// Write versioned file
const versionedPath = path.resolve(__dirname, `../references/insights-node-references-${version}.json`);
fs.writeFileSync(versionedPath, JSON.stringify(output, null, 2));

// Copy to latest file
const latestPath = path.resolve(__dirname, '../references/insights-node-references-latest.json');
fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));