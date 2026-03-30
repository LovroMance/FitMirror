export class HttpError extends Error {
  statusCode: number;
  code: number;

  constructor(message: string, statusCode = 400, code = 40000) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
