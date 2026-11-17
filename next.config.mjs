/** Static export so the demo can be hosted as plain files. */
const basePath = process.env.BASE_PATH ?? "/lab-erp";
export default {
  output: "export",
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
};
