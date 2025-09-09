declare module 'virtual:keystatic.config' {
  import { Config } from '@keystatic/core'

  namespace ns {
    const keystaticConfig: Config<any, any>
  }
  export default ns.keystaticConfig
}
