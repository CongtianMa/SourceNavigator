export const mcpTools = [
    // {
    //     name: "go_to_definition",
    //     description: "Navigates to the original definition of a symbol at a specified location in code. " +
    //         "This tool performs semantic analysis to find the true source definition, not just matching text. It can locate:\n" +
    //         "- Function/method declarations\n" +
    //         "- Class/interface definitions\n" +
    //         "- Variable declarations\n" +
    //         "- Type definitions\n" +
    //         "- Import/module declarations\n\n" +
    //         "The tool is essential for:\n" +
    //         "- Understanding where code elements are defined\n" +
    //         "- Navigating complex codebases\n" +
    //         "- Verifying the actual implementation of interfaces/abstractions\n\n" +
    //         "",
    //     inputSchema: {
    //         type: "object",
    //         properties: {
    //             target_file: {
    //                 type: "string",
    //                 description: "The file containing the symbol",
    //             },
    //             position: {
    //                 type: "object",
    //                 description: "The position of the symbol",
    //                 properties: {
    //                     line: {
    //                         type: "number",
    //                         description: "Zero-based line number"
    //                     },
    //                     character: {
    //                         type: "number",
    //                         description: "Zero-based character position (column)"
    //                     }
    //                 },
    //                 required: ["line", "character"]
    //             }
    //         },
    //         required: ["target_file", "position"]
    //     }
    // },
    // {
    //     name: "get_symbol_definition",
    //     description: "Searches for symbols across the entire workspace. This is useful for finding symbols by name across all files. Especially useful for finding the file and positions of a symbol to use in other tools.",
    //     inputSchema: {
    //         type: "object",
    //         properties: {
    //             query: {
    //                 type: "string",
    //                 description: "The search query for finding symbols"
    //             }
    //         },
    //         required: ["query"]
    //     }
    // },
    {
        name: "get_type_definition",
        description: "Searches for type definitions across the entire workspace. This is useful for understanding the structure, properties, or methods of a type.\n\n"+
        "Use cases:\n"+
        "- Viewing interface definitions to understand available properties and methods\n"+
        "- Finding type aliases or union type definitions\n"+
        "- Understanding enum type values\n"+
        "- Checking class inheritance and members\n"+
        "- Verifying type imports\n\n"+
        "Suggestions:\n"+
        "- Use fully qualified names (e.g., 'MyNamespace.MyType') for more precise results\n"+
        "- In multi-window environments, specify workspace_path to target specific workspace\n",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name of the type to find, it is recommended to use fully qualified names for more precise results"
                },
                workspace_path: {
                    type: "string",
                    description: "Optional workspace path for multi-window routing. If not specified, uses the default workspace."
                }
            },
            required: ["name"]
        }
    },
    {
        name: "read_outer_file",
        description: "Reads the contents of a file, especially external dependencies, configuration files, or project documents.\n\n"+
        "Use cases:\n"+
        "- Viewing the source code of third-party libraries to understand API usage\n"+
        "- Reading configuration files to understand project settings\n"+
        "- Viewing documentation files for usage instructions\n"+
        "- Analyzing the structure and interfaces of dependency packages\n"+
        "- Checking the content of external resources\n\n"+
        "Suggestions:\n"+
        "- For large files, it is recommended to specify a line range to improve efficiency\n"+
        "- Small files or when explicitly requested by the user, the entire file can be read\n"+
        "- Supports relative paths, absolute paths, and URI formats\n"+
        "- In multi-window environments, specify workspace_path to target specific workspace\n",
        inputSchema: {
            type: "object",
            properties: {
                target_file: {
                    type: "string",
                    description: "The path of the file to read, supports relative paths, absolute paths, or URI formats"
                },
                should_read_entire_file: {
                    type: "boolean",
                    description: "Whether to read the entire file, default is false. It is recommended to set to true only for small files or files explicitly specified by the user"
                },
                start_line_one_indexed: {
                    type: "integer",
                    description: "Required when should_read_entire_file is false. The line number to start reading (starts from 1)"
                },
                end_line_one_indexed_inclusive: {
                    type: "integer",
                    description: "Required when should_read_entire_file is false. The line number to end reading (inclusive of this line)"
                },
                workspace_path: {
                    type: "string",
                    description: "Optional workspace path for multi-window routing. If not specified, uses the default workspace."
                }
            },
            required: ["target_file"]
        }
    }
];

export const toolsDescriptions = [
    // {
    //     name: "go_to_definition",
    //     description: "Find definition of a symbol"
    // },
    {
        name: "get_type_definition",
        description: "Finds all definitions for a given type name across the workspace."
    },
    {
        name: "read_outer_file",
        description: "Reads a file from a relative/absolute path or a URI."
    }
];

// 工具使用提示词
export const toolUsagePrompt = `
## 项目理解工具使用指南

当需要深入了解项目结构和代码时，请优先使用以下两个工具：

### 1. get_type_definition - 类型定义查找工具
**何时使用：**
- 遇到不熟悉的类型、接口或类时
- 需要了解某个类型的属性和方法时
- 查看枚举值或联合类型定义时
- 验证类型导入或检查继承关系时

**使用建议：**
- 优先使用全限定名称（如 'MyNamespace.MyType'）获得精确结果
- 如果类型名冲突，可配合 container_name 参数缩小范围

**示例场景：**
- 用户问："这个 User 接口有哪些属性？"
- 代码中出现未知类型时
- 需要了解第三方库的类型定义时

### 2. read_outer_file - 外部文件读取工具
**何时使用：**
- 需要查看第三方库源码了解API用法时
- 读取配置文件了解项目设置时
- 查看文档文件获取使用说明时
- 分析依赖包结构时

**使用建议：**
- 大文件建议指定行范围提高效率
- 小文件或用户明确要求时可读取整个文件
- 支持相对路径、绝对路径和URI格式

**⚠️ 重要：URI处理注意事项**
当从 get_type_definition 获取的URI传递给 read_outer_file 时：
- 确保URI保持原始格式，不要手动修改
- 特别注意JDT URI格式（如jdt://contents/...）
- 避免对URI进行额外的编码或解码操作
- 如果URI包含特殊字符，直接使用原始URI即可

**示例场景：**
- 用户问："这个库怎么用？"
- 需要查看 package.json 了解依赖时
- 查看 README 或文档时

### 使用流程建议：
1. 首先尝试使用 get_type_definition 查找相关类型定义
2. 如果需要更详细的上下文，使用 read_outer_file 读取相关文件
   - **直接使用** get_type_definition 返回的 target_file 值
   - **不要修改** URI中的任何字符
3. 根据获取的信息为用户提供准确的解答

### 常见问题解决：
- **URI编码问题**：如果遇到URI解析错误，检查是否对URI进行了不必要的修改
- **JDT URI**：Java开发工具URI格式需要特殊处理，保持原始格式
- **Maven依赖**：jar包内的类文件URI通常包含复杂的查询参数，直接使用即可

记住：这两个工具是理解项目的核心工具，合理使用它们可以大大提高回答的准确性和深度。
`;