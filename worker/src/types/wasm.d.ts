declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "@jsquash/*/codec/**/*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "@jsquash/*/lib/**/*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
