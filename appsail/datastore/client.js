import catalyst from "zcatalyst-sdk-node";

/**
 * AppSail: Catalyst must be initialized PER REQUEST
 */
export function getCatalystApp(req) {
  if (!req) {
    throw new Error("Request object is required for Catalyst initialization");
  }
  return catalyst.initialize(req);
}

export function getDatastore(req) {
  return getCatalystApp(req).datastore();
}

export function getZCQL(req) {
  return getCatalystApp(req).zcql();
}
