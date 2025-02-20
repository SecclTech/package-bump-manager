import { APIGatewayProxyResult, Context } from "aws-lambda";
import DependencyStore from "./dependancy_store.js";
import PackageUpdater from "./package_updater.js";

const DYNAMODB_TABLE = "RepoDependancies";
const OWNER = "ShayaanKianiSeccl";

export const handler = async (
  event: Record<string, any>,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Received event:", event);

    if (!event.request_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid payload: Request does not have a request_type"
        })
      };
    }

    switch (event.request_type) {
      case "store_dependancy": {
        const dependencyStore = new DependencyStore(DYNAMODB_TABLE);
        const { repository, package_name, dependencies } = event;
        return await dependencyStore.store(repository, package_name, dependencies);
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
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};
