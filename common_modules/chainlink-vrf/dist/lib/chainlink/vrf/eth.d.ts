import { curve } from "elliptic";
import BasePoint = curve.base.BasePoint;
export declare function pointToAddress(p: BasePoint): string;
