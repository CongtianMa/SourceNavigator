// 测试文件 - 用于验证 Source Navigator 功能

/**
 * 示例类 - 用于测试代码导航功能
 */
export class ExampleClass {
    private name: string;
    private value: number;

    constructor(name: string, value: number) {
        this.name = name;
        this.value = value;
    }

    /**
     * 获取名称
     * @returns 名称字符串
     */
    getName(): string {
        return this.name;
    }

    /**
     * 获取值
     * @returns 数值
     */
    getValue(): number {
        return this.value;
    }

    /**
     * 设置名称
     * @param name 新的名称
     */
    setName(name: string): void {
        this.name = name;
    }

    /**
     * 设置值
     * @param value 新的值
     */
    setValue(value: number): void {
        this.value = value;
    }

    /**
     * 计算总和
     * @param other 另一个示例对象
     * @returns 总和
     */
    add(other: ExampleClass): number {
        return this.value + other.value;
    }
}

/**
 * 示例接口 - 用于测试接口实现
 */
export interface ExampleInterface {
    getName(): string;
    getValue(): number;
}

/**
 * 示例函数 - 用于测试函数导航
 * @param input 输入字符串
 * @returns 处理后的字符串
 */
export function processString(input: string): string {
    return input.toUpperCase().trim();
}

/**
 * 示例常量 - 用于测试常量查找
 */
export const EXAMPLE_CONSTANT = "Hello, Source Navigator!";

/**
 * 示例枚举 - 用于测试枚举导航
 */
export enum ExampleEnum {
    FIRST = "first",
    SECOND = "second",
    THIRD = "third"
}

/**
 * 示例类型别名 - 用于测试类型导航
 */
export type ExampleType = string | number | boolean;

/**
 * 示例命名空间 - 用于测试命名空间导航
 */
export namespace ExampleNamespace {
    export function helperFunction(): void {
        console.log("Helper function called");
    }

    export const helperConstant = 42;
} 