import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// Format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'kaisign-bot' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),

    // Bot activity log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/bot-activity.log'),
      level: 'info',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 15
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom logging methods for bot-specific events
export const botLogger = {
  submission: (message: string, metadata?: any) => {
    logger.info(message, { category: 'submission', ...metadata });
  },

  verification: (message: string, metadata?: any) => {
    logger.info(message, { category: 'verification', ...metadata });
  },

  discovery: (message: string, metadata?: any) => {
    logger.info(message, { category: 'discovery', ...metadata });
  },

  transaction: (message: string, metadata?: any) => {
    logger.info(message, { category: 'transaction', ...metadata });
  },

  error: (message: string, error?: any, metadata?: any) => {
    logger.error(message, { error, ...metadata });
  },

  performance: (message: string, duration?: number, metadata?: any) => {
    logger.info(message, { category: 'performance', duration, ...metadata });
  },

  economic: (message: string, metadata?: any) => {
    logger.info(message, { category: 'economic', ...metadata });
  }
};

// Performance timing utility
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
  }

  end(metadata?: any): number {
    const duration = performance.now() - this.startTime;
    botLogger.performance(`${this.label} completed`, duration, metadata);
    return duration;
  }
}