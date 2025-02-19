import { APIGatewayProxyResult, Context } from "aws-lambda";
import DependencyStore from "./dependancy_store.js";
import PackageUpdater from "./package_updater.js";

const DYNAMODB_TABLE = "RepoDependancies";
const OWNER = "ShayaanKianiSeccl";

export const handler = async (
    event: Record<string, any>,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        console.log("Received event:", event);

        const requestType = event.request_type;
        
        const validRequestTypes = ["store_dependancy", "bump_parents"];
        console.log("Request Type:", requestType);

        if (!requestType || !validRequestTypes.includes(requestType)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid payload: Request does not have a valid request_type" })
            };
        }

        if (requestType === "store_dependancy") {
            const { repository, package_name, dependencies } = event;
            const dependencyStore = new DependencyStore(DYNAMODB_TABLE);
            return await dependencyStore.store(repository, package_name, dependencies);
        }

        if (requestType === "bump_parents") {
            const packageName = event.updated_package;
            const newVersion = event.updated_package_version;

            const updater = new PackageUpdater(OWNER);
            return await updater.bumpParents(packageName, newVersion);
        }
        

        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid request_type" })
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })
        };
    }
};