import React from 'react';
import ParameterInputs from '../ParameterInputs';
import type { FunctionFormProps } from '../types';

const FunctionForm: React.FC<FunctionFormProps> = ({
  fn,
  values,
  onChange,
  disabled,
}) => {
  return (
    <div className="form-section">
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
