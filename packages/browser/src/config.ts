import packageInfo from '../package.json'

// overridden in insights-core,
// e.g.     Config.DEBUG = Config.DEBUG || instance.config.debug
const Config = {
    DEBUG: false,
    LIB_VERSION: packageInfo.version,
}

export default Config
