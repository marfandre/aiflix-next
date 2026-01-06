// Type declarations for color-namer library
declare module 'color-namer' {
    interface ColorName {
        name: string;
        hex: string;
        distance: number;
    }

    interface ColorNamerResult {
        roygbiv: ColorName[];
        basic: ColorName[];
        html: ColorName[];
        x11: ColorName[];
        pantone: ColorName[];
        ntc: ColorName[];
    }

    function namer(color: string): ColorNamerResult;
    export default namer;
}
