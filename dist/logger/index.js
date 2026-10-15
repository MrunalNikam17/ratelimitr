"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
function createLogger(level = 'info') {
    return (0, pino_1.default)({
        level,
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        formatters: {
            level: (label) => ({ level: label }),
        },
    });
}
exports.logger = createLogger(process.env['LOG_LEVEL'] || 'info');
//# sourceMappingURL=index.js.map