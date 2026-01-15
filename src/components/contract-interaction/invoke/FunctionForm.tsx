import React from 'react';
import ParameterInputs from '../ParameterInputs';
import type { FunctionFormProps } from '../types';

const styles = {
  section: 'flex flex-col gap-4 pt-4 border-t border-default',
} as const;

const FunctionForm: React.FC<FunctionFormProps> = ({
  fn,
  values,
  onChange,
  disabled,
}) => {
  return (
    <div className={styles.section}>
      <ParameterInputs
        inputs={fn.inputs}
        values={values}
        onChange={onChange}
        disabled={disabled}
        showNestedPath
        trimOnChange
      />
    </div>
  );
};

export default FunctionForm;
