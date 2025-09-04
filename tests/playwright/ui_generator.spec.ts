import { test, expect } from '@playwright/test';
import { ContractUIGenerator } from '../../src/services/aztec/ui/ContractUIGenerator';
import { AztecArtifactService } from '../../src/services/aztec/artifacts/AztecArtifactService';
import { ContractArtifact } from '@aztec/stdlib/abi';
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };

/**
 * Playwright tests for ContractUIGenerator UI behavior and integration
 * 
 * These tests focus on the UI aspects and user interactions that would
 * be generated from the ContractUIGenerator service, ensuring the
 * generated configurations work properly in a browser environment.
 */

test.describe('ui generator', () => {
  let generator: ContractUIGenerator;
  let artifactService: AztecArtifactService;

  test.beforeEach(async ({ page }) => {
    generator = new ContractUIGenerator();
    artifactService = new AztecArtifactService();
    
    // Navigate to a test page where we can inject our UI generator
    await page.goto('http://localhost:3000');
  });

  test('generates valid HTML structure for contract UI', async ({ page }) => {
    // Parse the Dripper contract
    const dripperMetadata = artifactService.parseArtifact(dripperArtifact as unknown as ContractArtifact);
    const uiConfig = generator.generateContractUI(dripperMetadata);

    // Inject UI generator results into the page for testing
    await page.evaluate((config) => {
      // Create a test container
      const container = document.createElement('div');
      container.id = 'contract-ui-test';
      container.innerHTML = `
        <div class="contract-ui">
          <h2>Contract: ${config.metadata.name}</h2>
          <div class="function-categories">
            ${config.categories.initializers.length > 0 ? `
              <div class="initializers-section">
                <h3>🚀 Initializers (${config.categories.initializers.length})</h3>
                ${config.categories.initializers.map(func => `
                  <div class="function-card initializer" data-function="${func.function.name}">
                    <span class="function-icon">${func.display.icon}</span>
                    <span class="function-title">${func.display.title}</span>
                    <span class="function-params">${func.inputFields.length} parameters</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${config.categories.private.length > 0 ? `
              <div class="private-section">
                <h3>🔒 Private Functions (${config.categories.private.length})</h3>
                ${config.categories.private.map(func => `
                  <div class="function-card private" data-function="${func.function.name}">
                    <span class="function-icon">${func.display.icon}</span>
                    <span class="function-title">${func.display.title}</span>
                    <span class="function-params">${func.inputFields.length} parameters</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${config.categories.unconstrained.length > 0 ? `
              <div class="unconstrained-section">
                <h3>⚡ View Functions (${config.categories.unconstrained.length})</h3>
                ${config.categories.unconstrained.map(func => `
                  <div class="function-card unconstrained" data-function="${func.function.name}">
                    <span class="function-icon">${func.display.icon}</span>
                    <span class="function-title">${func.display.title}</span>
                    <span class="function-params">${func.inputFields.length} parameters</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }, uiConfig);

    // Verify the basic structure is rendered
    await expect(page.locator('#contract-ui-test')).toBeVisible();
    await expect(page.locator('.contract-ui h2')).toContainText('Contract: Dripper');

    // Verify initializer section
    await expect(page.locator('.initializers-section')).toBeVisible();
    await expect(page.locator('.initializers-section h3')).toContainText('🚀 Initializers (1)');
    await expect(page.locator('.function-card.initializer')).toHaveCount(1);
    await expect(page.locator('[data-function="constructor"]')).toBeVisible();

    // Verify private functions section
    await expect(page.locator('.private-section')).toBeVisible();
    await expect(page.locator('.private-section h3')).toContainText('🔒 Private Functions (1)');
    await expect(page.locator('.function-card.private')).toHaveCount(1);
    await expect(page.locator('[data-function="drip_to_private"]')).toBeVisible();

    // Verify unconstrained functions section
    await expect(page.locator('.unconstrained-section')).toBeVisible();
    await expect(page.locator('.unconstrained-section h3')).toContainText('⚡ View Functions (4)');
    await expect(page.locator('.function-card.unconstrained')).toHaveCount(4);
  });

  test('generates interactive form fields for function parameters', async ({ page }) => {
    const dripperMetadata = artifactService.parseArtifact(dripperArtifact as unknown as ContractArtifact);
    const dripToPrivateFunc = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
    const functionUIConfig = generator.generateFunctionUI(dripToPrivateFunc);

    // Inject a form for the drip_to_private function
    await page.evaluate((config) => {
      const container = document.createElement('div');
      container.id = 'function-form-test';
      container.innerHTML = `
        <div class="function-form">
          <h3>${config.display.title}</h3>
          <p>${config.display.description}</p>
          <form id="function-execution-form">
            ${config.inputFields.map(field => {
              switch (field.field.type) {
                case 'address':
                  return `
                    <div class="field-group">
                      <label for="${field.field.id}">${field.field.label}</label>
                      <input 
                        type="text" 
                        id="${field.field.id}" 
                        name="${field.field.name}"
                        placeholder="${field.field.placeholder}"
                        ${field.validation.required ? 'required' : ''}
                        ${field.validation.pattern ? `pattern="${field.validation.pattern}"` : ''}
                      />
                      ${field.field.helpText ? `<small class="help-text">${field.field.helpText}</small>` : ''}
                    </div>
                  `;
                case 'bigint':
                  return `
                    <div class="field-group">
                      <label for="${field.field.id}">${field.field.label}</label>
                      <input 
                        type="number" 
                        id="${field.field.id}" 
                        name="${field.field.name}"
                        placeholder="${field.field.placeholder}"
                        ${field.validation.required ? 'required' : ''}
                        ${field.validation.min !== undefined ? `min="${field.validation.min}"` : ''}
                        ${field.validation.max !== undefined ? `max="${field.validation.max}"` : ''}
                      />
                      ${field.field.helpText ? `<small class="help-text">${field.field.helpText}</small>` : ''}
                    </div>
                  `;
                case 'object':
                  return `
                    <div class="field-group">
                      <label for="${field.field.id}">${field.field.label}</label>
                      <textarea 
                        id="${field.field.id}" 
                        name="${field.field.name}"
                        placeholder="Enter JSON object"
                        ${field.validation.required ? 'required' : ''}
                        rows="4"
                      ></textarea>
                      ${field.field.helpText ? `<small class="help-text">${field.field.helpText}</small>` : ''}
                    </div>
                  `;
                default:
                  return `
                    <div class="field-group">
                      <label for="${field.field.id}">${field.field.label}</label>
                      <input 
                        type="text" 
                        id="${field.field.id}" 
                        name="${field.field.name}"
                        placeholder="${field.field.placeholder}"
                        ${field.validation.required ? 'required' : ''}
                      />
                    </div>
                  `;
              }
            }).join('')}
            <button type="submit" class="execute-button">Execute Function</button>
          </form>
        </div>
      `;
      document.body.appendChild(container);
    }, functionUIConfig);

    // Verify form structure
    await expect(page.locator('#function-form-test')).toBeVisible();
    await expect(page.locator('.function-form h3')).toContainText('Drip To Private');
    await expect(page.locator('#function-execution-form')).toBeVisible();

    // Verify input fields are generated correctly
    await expect(page.locator('textarea[name="inputs"]')).toBeVisible();
    await expect(page.locator('input[name="token_address"]')).toBeVisible();
    await expect(page.locator('input[name="amount"]')).toBeVisible();

    // Test field validation
    const tokenAddressField = page.locator('input[name="token_address"]');
    await expect(tokenAddressField).toHaveAttribute('required');
    await expect(tokenAddressField).toHaveAttribute('pattern', '^0x[a-fA-F0-9]{64}$');

    const amountField = page.locator('input[name="amount"]');
    await expect(amountField).toHaveAttribute('type', 'number');
    await expect(amountField).toHaveAttribute('required');

    // Test help text for token address field specifically
    await expect(page.locator('input[name="token_address"]').locator('..').locator('.help-text')).toContainText('Aztec address format: 0x followed by 64 hexadecimal characters');
  });

  test('handles form validation and user input', async ({ page }) => {
    const dripperMetadata = artifactService.parseArtifact(dripperArtifact as unknown as ContractArtifact);
    const dripToPrivateFunc = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
    const functionUIConfig = generator.generateFunctionUI(dripToPrivateFunc);

    // Create a simplified form for testing user interactions
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'validation-test';
      container.innerHTML = `
        <form id="validation-form">
          <input 
            type="text" 
            id="token_address" 
            name="token_address"
            placeholder="Enter Aztec address (0x...)"
          />
          <input 
            type="number" 
            id="amount" 
            name="amount"
            placeholder="Enter positive number"
          />
          <button type="submit">Execute</button>
          <div id="validation-messages"></div>
        </form>
      `;
      
      document.body.appendChild(container);
      
      // Add validation logic after appending to DOM
      const form = document.querySelector('#validation-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const tokenAddressEl = document.querySelector('#token_address') as HTMLInputElement;
          const amountEl = document.querySelector('#amount') as HTMLInputElement;
          const messages = document.querySelector('#validation-messages') as HTMLElement;
          
          const tokenAddress = tokenAddressEl?.value || '';
          const amount = amountEl?.value || '';
          
          let isValid = true;
          let validationErrors: string[] = [];
          
          if (!tokenAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
            isValid = false;
            validationErrors.push('Invalid Aztec address format');
          }
          
          if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
            isValid = false;
            validationErrors.push('Amount must be a positive number');
          }
          
          if (isValid) {
            messages.innerHTML = '<div class="success">Validation passed!</div>';
            messages.style.color = 'green';
          } else {
            messages.innerHTML = '<div class="error">' + validationErrors.join('<br>') + '</div>';
            messages.style.color = 'red';
          }
        });
      }
    });

    // Test invalid inputs
    await page.fill('#token_address', 'invalid-address');
    await page.fill('#amount', '-5');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('#validation-messages .error')).toBeVisible();
    await expect(page.locator('#validation-messages')).toContainText('Invalid Aztec address format');
    await expect(page.locator('#validation-messages')).toContainText('Amount must be a positive number');

    // Test valid inputs
    await page.fill('#token_address', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    await page.fill('#amount', '100');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('#validation-messages .success')).toBeVisible();
    await expect(page.locator('#validation-messages')).toContainText('Validation passed!');
  });

  test('displays contract with no initializers correctly', async ({ page }) => {
    // Create mock metadata without initializers
    const mockMetadata = {
      name: 'TestContract',
      functions: [
        { name: 'testFunction', visibility: 'public', isInitializer: false, parameters: [] }
      ],
      initializers: []
    };

    const mockUIConfig = generator.generateContractUI(mockMetadata as any);

    await page.evaluate((config) => {
      const container = document.createElement('div');
      container.id = 'no-initializers-test';
      container.innerHTML = `
        <div class="contract-ui">
          <h2>Contract: ${config.metadata.name}</h2>
          ${config.validation.hasInitializers ? `
            <div class="initializers-section">
              <h3>🚀 Initializers</h3>
            </div>
          ` : `
            <div class="no-initializers-notice">
              <p>ℹ️ This contract does not require initialization</p>
            </div>
          `}
          <div class="function-count">
            Total functions: ${config.validation.totalFunctions}
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }, mockUIConfig);

    // Verify no initializers message is shown
    await expect(page.locator('.no-initializers-notice')).toBeVisible();
    await expect(page.locator('.no-initializers-notice')).toContainText('This contract does not require initialization');
    await expect(page.locator('.initializers-section')).not.toBeVisible();
    await expect(page.locator('.function-count')).toContainText('Total functions: 1');
  });

  test('function icons and colors are applied correctly', async ({ page }) => {
    const dripperMetadata = artifactService.parseArtifact(dripperArtifact as unknown as ContractArtifact);
    const uiConfig = generator.generateContractUI(dripperMetadata);

    await page.evaluate((config) => {
      const container = document.createElement('div');
      container.id = 'styling-test';
      
      // Add CSS for testing
      const style = document.createElement('style');
      style.textContent = `
        .function-card { 
          padding: 10px; 
          margin: 5px 0; 
          border: 1px solid #ccc; 
          border-radius: 4px;
        }
        .function-card.initializer { border-color: #f59e0b; }
        .function-card.private { border-color: #8b5cf6; }
        .function-card.unconstrained { border-color: #10b981; }
      `;
      document.head.appendChild(style);
      
      container.innerHTML = `
        <div class="contract-ui">
          ${config.categories.initializers.map(func => `
            <div class="function-card initializer" style="border-color: ${func.display.color}">
              <span class="icon">${func.display.icon}</span>
              <span class="title">${func.display.title}</span>
              <span class="category">${func.display.category}</span>
            </div>
          `).join('')}
          ${config.categories.private.map(func => `
            <div class="function-card private" style="border-color: ${func.display.color}">
              <span class="icon">${func.display.icon}</span>
              <span class="title">${func.display.title}</span>
              <span class="category">${func.display.category}</span>
            </div>
          `).join('')}
          ${config.categories.unconstrained.map(func => `
            <div class="function-card unconstrained" style="border-color: ${func.display.color}">
              <span class="icon">${func.display.icon}</span>
              <span class="title">${func.display.title}</span>
              <span class="category">${func.display.category}</span>
            </div>
          `).join('')}
        </div>
      `;
      document.body.appendChild(container);
    }, uiConfig);

    // Verify initializer styling
    await expect(page.locator('.function-card.initializer .icon')).toContainText('🚀');
    await expect(page.locator('.function-card.initializer .category')).toContainText('initializer');
    await expect(page.locator('.function-card.initializer')).toHaveCSS('border-color', 'rgb(245, 158, 11)');

    // Verify private function styling
    await expect(page.locator('.function-card.private .icon')).toContainText('🔒');
    await expect(page.locator('.function-card.private .category')).toContainText('private');
    await expect(page.locator('.function-card.private')).toHaveCSS('border-color', 'rgb(139, 92, 246)');

    // Verify unconstrained function styling
    await expect(page.locator('.function-card.unconstrained .icon').first()).toContainText('⚡');
    await expect(page.locator('.function-card.unconstrained .category').first()).toContainText('unconstrained');
    await expect(page.locator('.function-card.unconstrained').first()).toHaveCSS('border-color', 'rgb(16, 185, 129)');
  });
});
