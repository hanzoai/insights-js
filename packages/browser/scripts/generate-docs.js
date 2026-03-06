const path = require('path');
const fs = require('fs');
const { generateApiSpecs } = require('../../../scripts/docs/parser');
const { HOG_REF, PROPERTIES_EXAMPLE, PROPERTY_EXAMPLE } = require('../../../scripts/docs/constants');

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;

const config = {
    packageDir: path.resolve(__dirname, '..'),  // packages/browser
    apiJsonPath: path.resolve(__dirname, '../docs/@hanzo/insights.api.json'),
    outputPath: path.resolve(__dirname, `../references/@hanzo/insights-references-${version}.json`),
    version: version,
    id: '@hanzo/insights',
    hogRef: HOG_REF,
    specInfo: {
        id: '@hanzo/insights',
        title: 'Insights JavaScript Web SDK',
        description: 'Insights-js allows you to automatically capture usage and send events to Insights.',
        slugPrefix: '@hanzo/insights',
        specUrl: 'https://github.com/Insights/@hanzo/insights'
    },
    typeExamples: {
        Properties: PROPERTIES_EXAMPLE,
        Property: PROPERTY_EXAMPLE
    },
    parentClass: 'Insights'
};

// Ensure references directory exists
const referencesDir = path.resolve(__dirname, '../references');
if (!fs.existsSync(referencesDir)) {
    fs.mkdirSync(referencesDir, { recursive: true });
}

// Generate versioned file
const output = generateApiSpecs(config);

// Write versioned file
const versionedPath = path.resolve(__dirname, `../references/@hanzo/insights-references-${version}.json`);
fs.writeFileSync(versionedPath, JSON.stringify(output, null, 2));

// Copy to latest file
const latestPath = path.resolve(__dirname, '../references/@hanzo/insights-references-latest.json');
fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));