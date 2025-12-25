declare module 'swagger-ui-react' {
  import { ComponentType } from 'react'

  interface SwaggerUIProps {
    spec?: any
    url?: string
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    defaultModelExpandDepth?: number
    displayRequestDuration?: boolean
    tryItOutEnabled?: boolean
    requestInterceptor?: (request: any) => any
    responseInterceptor?: (response: any) => any
    onComplete?: (system: any) => void
    [key: string]: any
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}