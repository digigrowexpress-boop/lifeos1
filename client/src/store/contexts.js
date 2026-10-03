import { createContext } from 'react';

/**
 * React contexts live in their own module so that hot-reloading the providers
 * during development never creates a second, empty context.
 */
export const SessionContext = createContext(null);
export const DataContext = createContext(null);
export const QuickContext = createContext(null);
