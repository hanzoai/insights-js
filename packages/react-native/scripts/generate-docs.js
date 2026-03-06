const path = require('path');
const fs = require('fs');
const { generateApiSpecs } = require('../../../scripts/docs/parser');
const { HOG_REF } = require('../../../scripts/docs/constants');

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

// React Native-specific configuration
const REACT_NATIVE_SPEC_INFO = {
    id: 'insights-react-native',
    title: 'Insights React Native SDK',
    description: 'Insights React Native SDK allows you to capture events and send them to Insights from your React Native applications.',
    slugPrefix: 'insights-react-native',
    specUrl: 'https://github.com/Insights/@hanzo/insights'
};

// React Native-specific type examples (can be customized as needed)
const REACT_NATIVE_TYPE_EXAMPLES = {
    InsightsEventProperties: `// Properties for React Native events
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
    InsightsEventProperty: `// Can be a string or an object
"user@example.com" | { name: "John", age: 25 }`
};

const config = {
    packageDir: path.resolve(__dirname, '..'),  // packages/react-native
    apiJsonPath: path.resolve(__dirname, '../docs/insights-react-native.api.json'),
    outputPath: path.resolve(__dirname, `../references/insights-react-native-references-${version}.json`),
    version: version,
    id: REACT_NATIVE_SPEC_INFO.id,
    hogRef: HOG_REF,
    specInfo: REACT_NATIVE_SPEC_INFO,
    typeExamples: REACT_NATIVE_TYPE_EXAMPLES,
    parentClass: 'Insights',
    extraMethods: ['InsightsProvider']
};

// Ensure references directory exists
const referencesDir = path.resolve(__dirname, '../references');
if (!fs.existsSync(referencesDir)) {
    fs.mkdirSync(referencesDir, { recursive: true });
}

// Generate versioned file
const output = generateApiSpecs(config);

// Write versioned file
const versionedPath = path.resolve(__dirname, `../references/insights-react-native-references-${version}.json`);
fs.writeFileSync(versionedPath, JSON.stringify(output, null, 2));

// Copy to latest file
const latestPath = path.resolve(__dirname, '../references/insights-react-native-references-latest.json');
fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));