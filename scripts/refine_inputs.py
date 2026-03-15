import os
import re

directories = [
    r'f:\hedera-v2\moderntensor_hedera\dashboard-ui\src\components\dashboard',
    r'f:\hedera-v2\moderntensor_hedera\dashboard-ui\src\components\ui-custom'
]

def refine_on_change(match):
    full_tag = match.group(0)
    
    # Only process numeric inputs
    if 'type="number"' not in full_tag and "type='number'" not in full_tag:
        return full_tag

    # Find onChange handler
    # Support: onChange={e => ...} or onChange={(e) => ...} or multiline
    on_change_pattern = re.compile(r'onChange=\{((?:e|\(e\))\s*=>\s*[^}]+)\}', re.DOTALL)
    on_change_match = on_change_pattern.search(full_tag)
    
    if not on_change_match:
        return full_tag
    
    on_change_content = on_change_match.group(1).strip()
    # Content is like: e => setSomething(e.target.value)
    
    # Extract the actual logic (everything after =>)
    logic_match = re.search(r'=>\s*(.*)', on_change_content, re.DOTALL)
    if not logic_match:
        return full_tag
    
    original_logic = logic_match.group(1).strip()
    
    # If it's already complex (starts with {), we might need to be careful
    if original_logic.startswith('{'):
        return full_tag # Skip already complex ones for safety
    
    is_number_cast = 'Number(e.target.value)' in original_logic
    
    # Rebuild the logic with sanitization
    new_logic = original_logic.replace('e.target.value', 'v').replace('Number(v)', 'v')
    
    if is_number_cast:
        sanitized_logic = f'''{{
          let v = e.target.value;
          if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
          {new_logic.replace('v', "v === '' ? '' : Number(v)")};
        }}'''
    else:
        sanitized_logic = f'''{{
          let v = e.target.value;
          if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
          {new_logic};
        }}'''

    # Clean up whitespace
    sanitized_logic = re.sub(r'\s+', ' ', sanitized_logic).strip()
    
    # Replace the old onChange with the new one
    new_tag = full_tag.replace(on_change_match.group(0), f'onChange={{(e) => {sanitized_logic}}}')
    return new_tag

for directory in directories:
    if not os.path.exists(directory): continue
    for filename in os.listdir(directory):
        if filename.endswith('.tsx'):
            filepath = os.path.join(directory, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'type="number"' in content or "type='number'" in content:
                # Target <input ... /> tags
                new_content = re.sub(r'<input.*?>', refine_on_change, content, flags=re.DOTALL)
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Refined inputs in: {filename}")

print("Refinement complete.")
