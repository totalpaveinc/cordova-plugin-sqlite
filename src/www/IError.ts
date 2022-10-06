
export interface IError {
    code: number;
    message?: string;
    cause?: IError;
    name: string;
    details?: {
        query?: string;
        [key: string]: any;
    }
}
