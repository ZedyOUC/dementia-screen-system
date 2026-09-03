import {
  COLLECTIONS,
  CORE_COLLECTION_NAMES,
  EXTENSION_COLLECTION_NAMES,
  type CollectionDefinition,
} from "../src/database/schema.js";

const errors: string[] = [];
const collectionNames = new Set<string>();

function addError(message: string): void {
  errors.push(message);
}

function validateCollection(collection: CollectionDefinition): void {
  if (collectionNames.has(collection.name)) {
    addError(`duplicate collection name: ${collection.name}`);
  }
  collectionNames.add(collection.name);

  const fieldNames = new Set(Object.keys(collection.fields));
  for (const index of collection.indexes) {
    for (const fieldName of index.fields) {
      if (!fieldNames.has(fieldName)) {
        addError(`${collection.name}: index references missing field ${fieldName}`);
      }
    }
  }

  for (const [fieldName, field] of Object.entries(collection.fields)) {
    if (field.type === "enum" && (!field.enumValues || field.enumValues.length === 0)) {
      addError(`${collection.name}.${fieldName}: enum must declare enumValues`);
    }
    if (field.type !== "enum" && field.enumValues) {
      addError(`${collection.name}.${fieldName}: enumValues only applies to enum fields`);
    }
  }
}

for (const collection of COLLECTIONS) {
  validateCollection(collection);
}

for (const expectedName of [...CORE_COLLECTION_NAMES, ...EXTENSION_COLLECTION_NAMES]) {
  if (!collectionNames.has(expectedName)) {
    addError(`expected collection is missing: ${expectedName}`);
  }
}

if (COLLECTIONS.length !== CORE_COLLECTION_NAMES.length + EXTENSION_COLLECTION_NAMES.length) {
  addError(
    `collection count mismatch: expected ${
      CORE_COLLECTION_NAMES.length + EXTENSION_COLLECTION_NAMES.length
    }, got ${COLLECTIONS.length}`,
  );
}

if (errors.length > 0) {
  console.error("Database schema validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Database schema ${COLLECTIONS.length} collections validated.`);
  console.log(`Core collections: ${CORE_COLLECTION_NAMES.join(", ")}`);
  console.log(`Extensions: ${EXTENSION_COLLECTION_NAMES.join(", ")}`);
}
