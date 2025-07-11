// MCP 工具定义
export const mcpTools = [
    {
        name: "go_to_definition",
        description: "Navigates to the original definition of a symbol at a specified location in code. " +
            "This tool performs semantic analysis to find the true source definition, not just matching text. It can locate:\n" +
            "- Function/method declarations\n" +
            "- Class/interface definitions\n" +
            "- Variable declarations\n" +
            "- Type definitions\n" +
            "- Import/module declarations\n\n" +
            "The tool is essential for:\n" +
            "- Understanding where code elements are defined\n" +
            "- Navigating complex codebases\n" +
            "- Verifying the actual implementation of interfaces/abstractions\n\n" +
            "Note: Line numbers are 0-based (first line is 0), while character positions are 0-based (first character is 0).",
        inputSchema: {
            type: "object",
            properties: {
                textDocument: {
                    type: "object",
                    description: "The document containing the symbol",
                    properties: {
                        uri: {
                            type: "string",
                            description: "URI of the document"
                        }
                    },
                    required: ["uri"]
                },
                position: {
                    type: "object",
                    description: "The position of the symbol",
                    properties: {
                        line: {
                            type: "number",
                            description: "One-based line number"
                        },
                        character: {
                            type: "number",
                            description: "Zero-based character position"
                        }
                    },
                    required: ["line", "character"]
                }
            },
            required: ["textDocument", "position"]
        }
    },
    // 新增 read_file_by_uri 工具
    {
        name: "read_file_by_uri",
        description: "Reads file content by URI. Supports reading the entire file or a specific line range. Input and output format is the same as read_file. URI supports file:// and jdt:// protocols.",
        inputSchema: {
            type: "object",
            properties: {
                uri: {
                    type: "string",
                    description: "The URI of the file to read. Supports file:// and jdt:// protocols."
                },
                should_read_entire_file: {
                    type: "boolean",
                    description: "Whether to read the entire file. True for the whole file, false for a specific line range."
                },
                start_line_one_indexed: {
                    type: "number",
                    description: "(Optional) The starting line number (1-based). Required if should_read_entire_file is false."
                },
                end_line_one_indexed_inclusive: {
                    type: "number",
                    description: "(Optional) The ending line number (inclusive, 1-based). Required if should_read_entire_file is false."
                },
                explanation: {
                    type: "string",
                    description: "(Optional) One sentence explanation for why this file is being read."
                }
            },
            required: ["uri", "should_read_entire_file"]
        },
        outputSchema: {
            type: "object",
            properties: {
                file_content: {
                    type: "string",
                    description: "The actual content read from the file."
                },
                summary_of_other_lines: {
                    type: "string",
                    description: "A brief summary of the lines not shown, if any."
                }
            },
            required: ["file_content"]
        }
    },
]; 