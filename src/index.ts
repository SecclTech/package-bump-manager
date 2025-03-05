import { APIGatewayProxyResult, Context } from "aws-lambda";
import DependencyStore from "./dependency_store.js";
import PackageUpdater from "./package_updater.js";

export const handler = async (
  event: Record<string, any>,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const { DYNAMODB_TABLE, GIT_OWNER } = process.env;

    if (!DYNAMODB_TABLE) {
      return {
        statusCode: 500,
        body: "Internal server error: Missing DYNAMODB_TABLE environment variable"
      }
    }
    if (!GIT_OWNER) {
      return {
        statusCode: 500,
        body: "Internal server error: Missing GIT_OWNER environment variable"
      }
    }
    console.log("DYNAMODB_TABLE:", DYNAMODB_TABLE, "GIT_OWNER:", GIT_OWNER);

    if (!event.request_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid payload: Request does not have a request_type"
        })
      };
    }
    console.log("Received event:", event.request_type);

    switch (event.request_type) {
      case "store_dependency": {
        const dependencyStore = new DependencyStore(DYNAMODB_TABLE);
        return await dependencyStore.store(event);
      }
      case "bump_parents": {
        const updater = new PackageUpdater(OWNER);
        const { package_name, new_version } = event;
        return await updater.bumpParents(package_name, new_version);
      }
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid request_type" })
        };
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};
