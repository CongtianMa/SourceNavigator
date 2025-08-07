export const mcpTools = [
    // {
    //     name: "get_type_definition",
    //     description: "Searches for type definitions across the entire workspace. This is useful for understanding the structure, properties, or methods of a type.\n\n"+
    //     "Use cases:\n"+
    //     "- Viewing interface definitions to understand available properties and methods\n"+
    //     "- Finding type aliases or union type definitions\n"+
    //     "- Understanding enum type values\n"+
    //     "- Checking class inheritance and members\n"+
    //     "- Verifying type imports\n\n"+
    //     "Suggestions:\n"+
    //     "- Use fully qualified names (e.g., 'MyNamespace.MyType') for more precise results\n"+
    //     "- In multi-window environments, specify workspace_path to target specific workspace\n",
    //     inputSchema: {
    //         type: "object",
    //         properties: {
    //             name: {
    //                 type: "string",
    //                 description: "The name of the type to find, it is recommended to use fully qualified names for more precise results"
    //             },
    //             workspace_path: {
    //                 type: "string",
    //                 description: "Optional workspace path for multi-window routing. If not specified, uses the default workspace."
    //             }
    //         },
    //         required: ["name"]
    //     }
    // },
    // {
    //     name: "read_outer_file",
    //     description: "Reads the contents of a file, especially external dependencies, configuration files, or project documents.\n\n"+
    //     "Use cases:\n"+
    //     "- Viewing the source code of third-party libraries to understand API usage\n"+
    //     "- Reading configuration files to understand project settings\n"+
    //     "- Viewing documentation files for usage instructions\n"+
    //     "- Analyzing the structure and interfaces of dependency packages\n"+
    //     "- Checking the content of external resources\n\n"+
    //     "Suggestions:\n"+
    //     "- For large files, it is recommended to specify a line range to improve efficiency\n"+
    //     "- Small files or when explicitly requested by the user, the entire file can be read\n"+
    //     "- Supports relative paths, absolute paths, and URI formats\n"+
    //     "- In multi-window environments, specify workspace_path to target specific workspace\n",
    //     inputSchema: {
    //         type: "object",
    //         properties: {
    //             target_file: {
    //                 type: "string",
    //                 description: "The path of the file to read, supports relative paths, absolute paths, or URI formats"
    //             },
    //             should_read_entire_file: {
    //                 type: "boolean",
    //                 description: "Whether to read the entire file, default is false. It is recommended to set to true only for small files or files explicitly specified by the user"
    //             },
    //             start_line_one_indexed: {
    //                 type: "integer",
    //                 description: "Required when should_read_entire_file is false. The line number to start reading (starts from 1)"
    //             },
    //             end_line_one_indexed_inclusive: {
    //                 type: "integer",
    //                 description: "Required when should_read_entire_file is false. The line number to end reading (inclusive of this line)"
    //             },
    //             workspace_path: {
    //                 type: "string",
    //                 description: "Optional workspace path for multi-window routing. If not specified, uses the default workspace."
    //             }
    //         },
    //         required: ["target_file"]
    //     }
    // },
    {
        name: "class_source",
        description: "通过类名(支持短类名)查找类文件并返回源码信息。支持项目本地类和第三方库类，对于没有源码的第三方类会自动使用反编译功能获取源码。 当遇到多个同名类时，回返回所有匹配的类的全限定名，需要通过再次调用class_source指定权限定类名来获取源码 默认返回源码文件前500行，可以通过指定line_offset和line_limit查询指定行",
        inputSchema: {
            type: "object",
            properties: {
                workspace_path: {
                    type: "string",
                    description: "当前工作区的绝对路径"
                },
                class_name: {
                    type: "string",
                    description: "类名，支持短类名"
                },
                line_offset: {
                    type: "integer",
                    description: "可选，默认0，表示从源码文件的第几行开始返回"
                },
                line_limit: {
                    type: "integer",
                    description: "可选，默认500，表示返回的源码行数"
                }
            },
            required: ["workspace_path", "class_name"]
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