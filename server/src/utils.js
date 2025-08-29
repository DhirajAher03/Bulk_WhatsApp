export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
export const ok = (data = {}, message = "ok") => ({ success: true, message, data });
export const fail = (message = "error", code = 400) => ({ success: false, message, code });
