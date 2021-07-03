export function handleTSPath (path: string) {
  return (/\//).test(path) && !/\./.test(path.split("/").slice(-1)[0]) 
} 