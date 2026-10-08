export * from './enums';

export namespace Prisma {
  export type InputJsonValue = any;
  export type JsonValue = any;
}

export class PrismaClient {
  constructor(options?: any) {}
  $connect() { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  $transaction(promises: any[]) { return Promise.all(promises); }
}
