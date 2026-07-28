import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config';
import { ConfigModule } from '../config/config.module';
import { REDACTED_LOG_PATHS } from './pii-redaction';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Logging is configured once, here. Application code injects `PinoLogger` and
 * logs structured objects (`logger.info({ bookingId }, 'booking confirmed')`) —
 * never `console`, never a hand-built string with values interpolated into it,
 * because the interpolated version cannot be searched or redacted.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          redact: REDACTED_LOG_PATHS,
          // One id follows a request through every log line it produces, is echoed
          // to the caller, and is returned in the error envelope — so a host's
          // screenshot of a failure is enough to find the exact server log.
          genReqId: (req, res) => {
            const incoming = req.headers[REQUEST_ID_HEADER];
            const id =
              (Array.isArray(incoming) ? incoming[0] : incoming) ??
              randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          autoLogging: {
            // Uptime probes hit this constantly and say nothing when they pass.
            ignore: (req) => req.url === '/health',
          },
          customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) {
              return 'error';
            }
            return res.statusCode >= 400 ? 'warn' : 'info';
          },
          transport: config.isDevelopment
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              }
            : undefined,
        },
      }),
    }),
  ],
})
export class ApiLoggingModule {}
