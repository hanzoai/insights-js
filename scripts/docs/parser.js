const apiExtractor = require('@microsoft/api-extractor-model');
const documentation = require('./documentation');
const examples = require('./examples');
const methods = require('./methods');
const types = require('./types');
const { writeFileSync, readFileSync } = require('fs');
const path = require('path');

const loadApiPackage = (filePath) => 
    apiExtractor.ApiPackage.loadFromJsonFile(filePath);

const findInsightsClass = (apiPackage, className) =>
    apiPackage.entryPoints[0].members.find(member =>
        member.kind === apiExtractor.ApiItemKind.Class && member.name === className
    );

// Find extra methods (functions/components) from the API package
const findExtraMethods = (apiPackage, extraMethodNames) => {
    if (!extraMethodNames || extraMethodNames.length === 0) {
        return [];
    }
    
    return apiPackage.entryPoints[0].members.filter(member =>
        (member.kind === apiExtractor.ApiItemKind.Function || 
         member.kind === apiExtractor.ApiItemKind.Class) && 
        extraMethodNames.includes(member.name)
    );
};

// Enhance types with examples
const enhanceTypeWithExample = (type, config) => {
    return config.typeExamples[type.name] 
        ? { ...type, example: config.typeExamples[type.name] }
        : type;
};

// Filter public methods
const filterPublicMethods = (insightsClass, parentClass) => 
    methods.collectMethodsWithInheritance(insightsClass, parentClass);

// Transform parameters
const transformParameter = (method) => (param) => ({
    description: documentation.getParamDescription(method, param.name) || '',
    isOptional: param.isOptional || false,
    type: param.parameterTypeExcerpt?.text || 'any',
    name: param.name || ''
});

// Transform methods
const transformMethod = (insightsClass) => (method) => {
    const returnType = method.returnTypeExcerpt?.text || 'any';
    
    return {
        category: documentation.extractCategoryTags(method.tsdocComment) || '',
        description: documentation.getDocComment(method),
        details: documentation.getRemarks(method),
        id: method.name,
        showDocs: true,
        title: method.name,
        examples: examples.extractExampleTags(method),
        releaseTag: methods.isMethodDeprecated(method) ? 'deprecated' : methods.getMethodReleaseTag(method),
        params: (method.parameters || []).map(transformParameter(method)),
        returnType: {
            id: returnType,
            name: returnType
        },
        ...(insightsClass && 'fileUrlPath' in insightsClass ? { path: insightsClass.fileUrlPath } : {})
    };
};

// Create class definition
const createClassDefinition = (insightsClass, functions) => ({
    description: documentation.getDocComment(insightsClass),
    id: insightsClass?.name || 'Insights',
    title: insightsClass?.name || 'Insights',
    functions
});

// Compose final output
const composeOutput = (insightsClass, functions, types, config) => ({
    id: config.id,
    hogRef: config.hogRef,
    info: {
        version: config.version,
        ...config.specInfo
    },
    classes: [createClassDefinition(insightsClass, functions)],
    types,
    // Set with most important categories first
    categories: [...new Set(['Initialization', 'Identification', 'Capture', ...functions.map(f => f.category).filter(Boolean)])]
});

const generateApiSpecs = (config) => {
    const apiPackage = loadApiPackage(config.apiJsonPath);
    const insightsClass = findInsightsClass(apiPackage, config.parentClass);
    
    const resolvedTypes = types
        .resolveTypeDefinitions(apiPackage)
        .map(type => enhanceTypeWithExample(type, config));
    
    const methods = filterPublicMethods(insightsClass, config.parentClass);
    const functions = methods.map(transformMethod(insightsClass));
    
    // Process extra methods if specified
    const extraMethods = findExtraMethods(apiPackage, config.extraMethods);
    const providerMethods = extraMethods.map(transformMethod(null));
    
    // Combine regular methods with extra methods
    const allFunctions = [...providerMethods,...functions];
    
    const output = composeOutput(insightsClass, allFunctions, resolvedTypes, config);
    
    return output;
};

module.exports = {
    generateApiSpecs
};