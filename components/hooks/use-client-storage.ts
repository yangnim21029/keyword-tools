import {
  useState,
  useEffect,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";

// Enum to represent storage types
enum StorageType {
  LocalStorage = "localStorage",
  SessionStorage = "sessionStorage",
  Memory = "memory",
}

// Helper function to check if storage is available and working
function isStorageAvailable(
  type: StorageType.LocalStorage | StorageType.SessionStorage,
): boolean {
  let storage: Storage | undefined;
  try {
    storage = window[type];
    if (!storage) return false;
    const testKey = "__testStorageAvailability__";
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

// Determine the best available storage mechanism
function getAvailableStorageType(): StorageType {
  if (isStorageAvailable(StorageType.LocalStorage)) {
    return StorageType.LocalStorage;
  }
  if (isStorageAvailable(StorageType.SessionStorage)) {
    return StorageType.SessionStorage;
  }
  return StorageType.Memory;
}

// The custom hook
export function useClientStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  // Determine the storage type once
  const [storageType] = useState<StorageType>(getAvailableStorageType);

  // Helper to get the appropriate storage object
  const getStorage = (): Storage | null => {
    if (storageType === StorageType.LocalStorage) {
      return window.localStorage;
    }
    if (storageType === StorageType.SessionStorage) {
      return window.sessionStorage;
    }
    return null; // Memory storage doesn't use a Storage object
  };

  // Get initial state from the best available storage or use initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    const storage = getStorage();
    if (!storage) {
      // Using memory storage
      return initialValue;
    }
    try {
      const item = storage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(`Error reading ${storageType} key “${key}”:`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore); // Update React state

        const storage = getStorage();
        if (storage) {
          // Persist to localStorage or sessionStorage
          storage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting ${storageType} key “${key}”:`, error);
      }
    },
    [key, storedValue, storageType],
  ); // Include storageType dependency

  // Effect to update state if localStorage changes in another tab/window
  // Note: 'storage' event primarily works reliably for localStorage.
  useEffect(() => {
    if (storageType !== StorageType.LocalStorage) return; // Only listen for localStorage changes

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === key &&
        event.storageArea === window.localStorage &&
        event.newValue !== JSON.stringify(storedValue) // Avoid infinite loop if change originated here
      ) {
        try {
          setStoredValue(
            event.newValue ? (JSON.parse(event.newValue) as T) : initialValue,
          );
        } catch (error) {
          console.error(
            `Error parsing storage change for key “${key}”:`,
            error,
          );
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
    // Add storedValue to dependency array to ensure the comparison in handler is up-to-date
  }, [key, initialValue, storageType, storedValue]);

  return [storedValue, setValue];
}
