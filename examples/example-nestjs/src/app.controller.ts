import { Controller, Get } from '@nestjs/common'
import { insights } from './main'

@Controller()
export class AppController {
    @Get()
    index() {
        insights.capture({ distinctId: 'EXAMPLE_APP_GLOBAL', event: 'nestjs capture' })
        return { hello: 'world' }
    }

    @Get('error')
    error() {
        throw new Error('example NestJS error')
    }
}
