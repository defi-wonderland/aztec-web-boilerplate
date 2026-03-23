import { create } from 'zustand';

export type FormValues = Record<string, string>;

type State = {
  values: FormValues;
};

type Actions = {
  setValue: (key: string, value: string) => void;
  reset: () => void;
};

export type FormStore = State & Actions;

const INITIAL_STATE: State = {
  values: {},
};

export const useFormStore = create<FormStore>((set) => ({
  ...INITIAL_STATE,

  setValue: (key, value) =>
    set((state) => ({
      values: { ...state.values, [key]: value },
    })),

  reset: () => set(INITIAL_STATE),
}));

export const getFormStore = () => useFormStore.getState();
