export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PagedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export namespace Auth {
  export interface LoginReq { username: string; password: string; }
  export interface LoginResp {
    token: string;
    user: { id: number; username: string; realName: string; role: 'admin' | 'operator' };
  }
  export interface CurrentUser {
    id: number; username: string; realName: string; role: string;
    phone?: string; lastLoginAt?: string;
  }
}

export namespace Room {
  export type Spec = 'small' | 'medium' | 'large' | 'vip';
  export type Status = 'available' | 'maintenance' | 'disabled';
  export interface Room {
    id: number; name: string; spec: Spec; capacity: number;
    basePrice: number; status: Status; description?: string; createdAt: string;
  }
  export type CurrentState = 'idle' | 'in_use' | 'reserved' | 'maintenance';
  export interface RoomStatus extends Room {
    currentState: CurrentState;
    currentSessionId?: number;
    remainingMinutes?: number;
    todayReservationCount: number;
  }
}

export namespace Reservation {
  export type Status = 'pending' | 'checked_in' | 'cancelled' | 'no_show';
  export interface Reservation {
    id: number; roomId: number; roomName?: string;
    customerName: string; customerPhone: string; peopleCount: number;
    startAt: string; endAt: string; status: Status;
    depositAmount: number; remark?: string;
    createdBy: number; createdAt: string; sessionId?: number;
  }
  export interface CheckConflictReq {
    roomId: number; startAt: string; endAt: string; excludeId?: number;
  }
  export interface CheckConflictResp { conflict: boolean; conflicting?: Reservation[]; }
}

export namespace Session {
  export type Status = 'active' | 'completed' | 'void';
  export interface Session {
    id: number; roomId: number; roomName?: string; reservationId?: number;
    customerName?: string; customerPhone?: string; peopleCount: number;
    startAt: string; scheduledEndAt: string; actualEndAt?: string;
    elapsedMinutes: number; overtimeMinutes: number; status: Status;
    roomFee: number; overtimeFee: number; rentalFee: number; goodsFee: number;
    discountAmount: number; totalAmount: number;
    createdBy: number; createdAt: string;
  }
  export interface CreateSessionReq {
    roomId: number; reservationId?: number;
    customerName?: string; customerPhone?: string;
    peopleCount: number; hours: number;
  }
  export interface ExtendReq { sessionId: number; addHours: number; }
  export interface AddGoodsReq {
    sessionId: number; goodsId: number; quantity: number;
  }
  export interface SessionDetail extends Session {
    goodsItems: Goods.GoodsItemInBill[];
    rentals: Rental.RentalInfo[];
  }
}

export namespace Boardgame {
  export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
  export interface Boardgame {
    id: number; name: string; coverImage?: string;
    category: string; difficulty: Difficulty;
    minPlayers: number; maxPlayers: number; playMinutes: number;
    accessories: string; deposit: number; rentalFee: number;
    stockTotal: number; stockAvailable: number;
    status: 'active' | 'archived'; remark?: string; createdAt: string;
  }
}

export namespace Rental {
  export type Status = 'active' | 'returned' | 'damaged' | 'lost';
  export interface Rental {
    id: number; sessionId?: number; sessionRoomName?: string; customerName?: string;
    boardgameId: number; boardgameName?: string;
    depositCollected: number; rentalFee: number; accessoriesChecked: string;
    status: Status; rentedAt: string; returnedAt?: string;
    accessoriesReturned?: string; damageFee: number; depositRefunded: number;
    createdBy: number; remark?: string;
  }
  export interface RentalInfo {
    id: number; boardgameId: number; boardgameName: string;
    rentalFee: number; depositCollected: number; status: Status;
  }
  export interface CreateRentalReq {
    sessionId?: number; boardgameId: number;
    depositCollected: number; accessoriesChecked: string;
    remark?: string;
  }
  export interface ReturnRentalReq {
    rentalId: number; accessoriesReturned: string;
    damageFee?: number; remark?: string;
  }
}

export namespace Goods {
  export interface Category { id: number; name: string; sort: number; }
  export interface Goods {
    id: number; categoryId: number; categoryName?: string;
    name: string; image?: string; price: number;
    stock: number; unit: string; status: 'on_sale' | 'off_sale'; createdAt: string;
  }
  export interface GoodsItemInBill {
    id: number; goodsId: number; name: string;
    quantity: number; unitPrice: number; subtotal: number;
  }
}

export namespace Bill {
  export type PayMethod = 'cash' | 'wechat' | 'alipay' | 'member' | 'mixed';
  export type ItemType = 'room' | 'overtime' | 'rental' | 'goods';
  export interface BillItem {
    id?: number; billId?: number;
    type: ItemType; name: string;
    quantity: number; unitPrice: number; subtotal: number; refId?: number;
  }
  export interface Bill {
    id: number; billNo: string; sessionId: number; roomId: number;
    roomName?: string; customerName?: string;
    startAt: string; endAt: string; durationMinutes: number;
    roomFee: number; overtimeFee: number; rentalFee: number; goodsFee: number;
    subtotal: number; discountAmount: number; totalAmount: number;
    payMethod: PayMethod; paidAmount: number; changeAmount: number; depositRefund: number;
    createdBy: number; createdAt: string; items: BillItem[];
  }
  export interface CheckoutReq {
    sessionId: number; discountAmount: number;
    payMethod: PayMethod; paidAmount: number;
  }
}

export namespace Settings {
  export interface PricingRule {
    overtimeUnit: 'minute' | 'half_hour' | 'hour';
    overtimeRate: number;
    overtimeMode: 'ratio' | 'fixed';
    minimumChargeMinutes: number;
    freeGraceMinutes: number;
    reminderMinutesBeforeEnd: number;
  }
  export interface GeneralSetting {
    shopName: string; shopPhone: string; shopAddress: string;
    businessStartTime: string; businessEndTime: string;
    enabledPayMethods: Bill.PayMethod[];
    receiptFooter: string;
  }
}

export namespace Reports {
  export interface OverviewData {
    todayRevenue: number; todayBillCount: number; todayAvgBill: number;
    todayRoomUtilization: number; weekRevenue: number;
    monthRevenue: number; monthOnMonth: number; pendingReminders: number;
  }
  export interface RevenuePoint { date: string; revenue: number; billCount: number; }
  export interface RoomUsageStat {
    roomId: number; roomName: string; usedMinutes: number;
    utilizationRate: number; revenue: number;
  }
  export interface BoardgameRentalRank {
    boardgameId: number; name: string;
    rentalCount: number; revenue: number;
  }
}

export namespace User {
  export type Role = 'admin' | 'operator';
  export interface User {
    id: number; username: string; realName: string; role: Role;
    phone?: string; status: 'active' | 'disabled';
    lastLoginAt?: string; createdAt: string;
  }
  export interface CreateUserReq {
    username: string; password: string;
    realName: string; role: Role; phone?: string;
  }
  export interface UpdateUserReq {
    realName?: string; role?: Role;
    phone?: string; status?: 'active' | 'disabled';
  }
  export interface ResetPwdReq { userId: number; newPassword: string; }
}
