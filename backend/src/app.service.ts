import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'Mob Duel Jr API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
