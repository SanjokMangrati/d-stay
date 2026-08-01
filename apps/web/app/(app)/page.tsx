import { propertiesList } from "@d-stay/api-client/endpoints/properties";
import { redirect } from "next/navigation";
import {
  NEW_PROPERTY_PATH,
  propertyHomePath,
} from "@/lib/properties/property-paths";

/**
 * There is no home above a property: a host works inside one, and the shell's
 * switcher is how they move between them. A host with none has exactly one
 * thing to do, so this sends them to it.
 */
export default async function HomePage() {
  const { properties } = await propertiesList();
  const [firstProperty] = properties;

  redirect(
    firstProperty ? propertyHomePath(firstProperty.id) : NEW_PROPERTY_PATH,
  );
}
