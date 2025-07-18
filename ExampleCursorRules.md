## Project Understanding Tool Usage Guide

When you need to deeply understand project structure and code, please prioritize using the following two tools:

### 1. mcp__get_type_definition - Type Definition Lookup Tool
**When to use:**
- When encountering unfamiliar types, interfaces, or classes
- When you need to understand the properties and methods of a type
- When viewing enum values or union type definitions
- When verifying type imports or checking inheritance relationships

**Usage recommendations:**
- Prioritize using fully qualified names (e.g., 'MyNamespace.MyType') for precise results

**Example scenarios:**
- User asks: "What properties does this User interface have?"
- When unknown types appear in code
- When you need to understand third-party library type definitions

### 2. mcp__read_outer_file - External File Reading Tool
**When to use:**
- When you need to view third-party library source code to understand API usage
- When reading configuration files to understand project settings
- When viewing documentation files to get usage instructions
- When analyzing dependency package structure

**Usage recommendations:**
- For large files, specify line ranges to improve efficiency
- For small files or when user explicitly requests, you can read the entire file
- Supports relative paths, absolute paths, and URI formats

**⚠️ Important: URI Handling Notes**
When passing URIs obtained from mcp__get_type_definition to mcp__read_outer_file:
- Ensure URIs maintain their original format, do not manually modify them
- Pay special attention to JDT URI format (e.g., jdt://contents/...)
- Avoid performing additional encoding or decoding operations on URIs
- If URIs contain special characters, use the original URI directly

**Example scenarios:**
- User asks: "How do I use this library?"
- When you need to view package.json to understand dependencies
- When viewing README or documentation

### Recommended Usage Flow:
1. First try using mcp__get_type_definition to find relevant type definitions
2. If more detailed context is needed, use mcp__read_outer_file to read relevant files
   - **Use directly** the target_file value returned by mcp__get_type_definition
   - **Do not modify** any characters in the URI
3. Provide accurate answers to users based on the obtained information

### Common Problem Solutions:
- **URI Encoding Issues**: If you encounter URI parsing errors, check if unnecessary modifications were made to the URI
- **JDT URI**: Java Development Tools URI format requires special handling, maintain original format
- **Maven Dependencies**: JAR package class file URIs usually contain complex query parameters, use directly

Remember: These two tools are the core tools for understanding projects. Using them appropriately can greatly improve the accuracy and depth of your answers.
