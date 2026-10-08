import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Applicant Copilot API')
    .setDescription(
      'Evidence-based applicant readiness. Requirements are DEMO configuration, not official criteria.',
    )
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}  (Swagger: /docs)`);
}
void bootstrap();
