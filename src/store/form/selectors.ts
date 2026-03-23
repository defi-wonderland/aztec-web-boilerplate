import { useShallow } from 'zustand/react/shallow';
import { useFormStore } from './store';

export const useFormValues = () => useFormStore((state) => state.values);

export const useFormActions = () =>
  useFormStore(
    useShallow((state) => ({
      setValue: state.setValue,
      reset: state.reset,
    }))
  );
