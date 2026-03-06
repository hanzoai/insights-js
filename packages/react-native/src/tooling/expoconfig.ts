// inspired from https://github.com/getsentry/sentry-react-native/blob/c1981913a90fad31d8e98ec4a7dcb35c7af46a04/packages/core/plugin/src/withSentryIOS.ts#L18

const { withAppBuildGradle, withXcodeProject } = require('@expo/config-plugins')

const resolveInsightsReactNativePackageJsonPath =
  "[\"node\", \"--print\", \"require('path').join(require('path').dirname(require.resolve('insights-react-native')), '..', 'tooling', 'insights.gradle')\"].execute().text.trim()"

const withAndroidPlugin = (config: any) => {
  return withAppBuildGradle(config, (config: any) => {
    if (config.modResults.language !== 'groovy') {
      console.warn('Cannot configure Insights in the app gradle because the build.gradle is not groovy')
    }

    const buildGradle = config.modResults.contents
    const applyFrom = `apply from: new File(${resolveInsightsReactNativePackageJsonPath})`

    if (buildGradle.includes(applyFrom)) {
      return config
    }

    // Find the 'android {' block and insert the line directly above it
    const pattern = /^android\s*\{/m

    if (buildGradle.match(pattern)) {
      config.modResults.contents = buildGradle.replace(pattern, `${applyFrom}\n\nandroid {`)
    } else {
      console.warn('Insights: Could not find "android {" block in build.gradle')
    }

    return config
  })
}

type BuildPhase = { shellScript: string }

export function modifyExistingXcodeBuildScript(script: BuildPhase): void {
  if (!script.shellScript.match(/(packager|scripts)\/react-native-xcode\.sh\b/)) {
    return
  }

  if (script.shellScript.includes('insights-xcode.sh')) {
    return
  }

  if (script.shellScript.includes('insights-react-native')) {
    return
  }

  const code = JSON.parse(script.shellScript)
  script.shellScript = JSON.stringify(addInsightsWithBundledScriptsToBundleShellScript(code))
}

const INSIGHTS_REACT_NATIVE_XCODE_PATH =
  "`\"$NODE_BINARY\" --print \"require('path').join(require('path').dirname(require.resolve('insights-react-native')), '..', 'tooling', 'insights-xcode.sh')\"`"

export function addInsightsWithBundledScriptsToBundleShellScript(script: string): string {
  return script.replace(
    /^.*?(packager|scripts)\/react-native-xcode\.sh\s*(\\'\\\\")?/m,
    // eslint-disable-next-line no-useless-escape
    (match: string) => `/bin/sh ${INSIGHTS_REACT_NATIVE_XCODE_PATH} ${match}`
  )
}

const withIosPlugin = (config: any) => {
  return withXcodeProject(config, (config: any) => {
    const xcodeProject = config.modResults

    const bundleReactNativePhase = xcodeProject.pbxItemByComment(
      'Bundle React Native code and images',
      'PBXShellScriptBuildPhase'
    )

    modifyExistingXcodeBuildScript(bundleReactNativePhase)

    return config
  })
}

const withInsightsPlugin = (config: any) => {
  config = withAndroidPlugin(config)
  return withIosPlugin(config)
}

module.exports = (config: any) => {
  return withInsightsPlugin(config)
}
