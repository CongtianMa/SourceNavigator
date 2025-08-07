export const mcpTools = [
    {
        name: "class_source",
        description: "Find class files by class name (supports short class names) and return source code information. " +
            "Supports both local project classes and third-party library classes. " +
            "For third-party classes without source code, automatic decompilation will be used to obtain source code. " +
            "When encountering multiple classes with the same name, all matching fully qualified class names will be returned. " +
            "You need to call class_source again with the fully qualified class name to get the source code. " +
            "By default returns the first 500 lines of the source file, and you can specify line_offset and line_limit to query specific lines",
        inputSchema: {
            type: "object",
            properties: {
                workspace_path: {
                    type: "string",
                    description: "Absolute path of the current workspace"
                },
                class_name: {
                    type: "string",
                    description: "Class name, supports short class names"
                },
                line_offset: {
                    type: "integer",
                    description: "Optional, default 0, indicates which line of the source file to start returning from"
                },
                line_limit: {
                    type: "integer",
                    description: "Optional, default 500, indicates the number of source code lines to return"
                }
            },
            required: ["workspace_path", "class_name"]
        }
    }
];