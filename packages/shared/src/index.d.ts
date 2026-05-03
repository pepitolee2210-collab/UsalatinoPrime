import { z } from "zod";
export declare const agencySchema: z.ZodEnum<{
    USCIS: "USCIS";
    EOIR: "EOIR";
    CBP: "CBP";
    DMV: "DMV";
    OTHER: "OTHER";
}>;
export declare const statusSeveritySchema: z.ZodEnum<{
    green: "green";
    yellow: "yellow";
    red: "red";
}>;
export declare const subscriptionTierSchema: z.ZodEnum<{
    free: "free";
    base: "base";
    premium: "premium";
    expert: "expert";
}>;
export declare const documentTypeSchema: z.ZodEnum<{
    OTHER: "OTHER";
    I94: "I94";
    I797C: "I797C";
    I765: "I765";
    EAD_CARD: "EAD_CARD";
    EOIR33: "EOIR33";
    NOTICE_OF_HEARING: "NOTICE_OF_HEARING";
    DRIVER_LICENSE: "DRIVER_LICENSE";
    PASSPORT: "PASSPORT";
}>;
export declare const filingTypeSchema: z.ZodEnum<{
    EOIR33: "EOIR33";
    AR11: "AR11";
    CHANGE_OF_VENUE: "CHANGE_OF_VENUE";
    I765_RENEWAL: "I765_RENEWAL";
}>;
export declare const alertKindSchema: z.ZodEnum<{
    court_hearing: "court_hearing";
    ead_expiration: "ead_expiration";
    biometrics: "biometrics";
    filing_deadline: "filing_deadline";
    address_change: "address_change";
    case_status_change: "case_status_change";
}>;
export declare const criticalAlertSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        court_hearing: "court_hearing";
        ead_expiration: "ead_expiration";
        biometrics: "biometrics";
        filing_deadline: "filing_deadline";
        address_change: "address_change";
        case_status_change: "case_status_change";
    }>;
    title: z.ZodString;
    detail: z.ZodString;
    dueAt: z.ZodString;
    dueLabel: z.ZodString;
    severity: z.ZodEnum<{
        green: "green";
        yellow: "yellow";
        red: "red";
    }>;
    source: z.ZodOptional<z.ZodEnum<{
        USCIS: "USCIS";
        EOIR: "EOIR";
        CBP: "CBP";
        DMV: "DMV";
        OTHER: "OTHER";
    }>>;
}, z.core.$strip>;
export declare const dashboardSummarySchema: z.ZodObject<{
    userName: z.ZodString;
    tier: z.ZodEnum<{
        free: "free";
        base: "base";
        premium: "premium";
        expert: "expert";
    }>;
    status: z.ZodEnum<{
        green: "green";
        yellow: "yellow";
        red: "red";
    }>;
    totals: z.ZodObject<{
        documentsExpiring: z.ZodNumber;
        pendingTasks: z.ZodNumber;
        activeCases: z.ZodNumber;
        newMessages: z.ZodNumber;
    }, z.core.$strip>;
    alerts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            court_hearing: "court_hearing";
            ead_expiration: "ead_expiration";
            biometrics: "biometrics";
            filing_deadline: "filing_deadline";
            address_change: "address_change";
            case_status_change: "case_status_change";
        }>;
        title: z.ZodString;
        detail: z.ZodString;
        dueAt: z.ZodString;
        dueLabel: z.ZodString;
        severity: z.ZodEnum<{
            green: "green";
            yellow: "yellow";
            red: "red";
        }>;
        source: z.ZodOptional<z.ZodEnum<{
            USCIS: "USCIS";
            EOIR: "EOIR";
            CBP: "CBP";
            DMV: "DMV";
            OTHER: "OTHER";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const smartFolderSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    agency: z.ZodOptional<z.ZodEnum<{
        USCIS: "USCIS";
        EOIR: "EOIR";
        CBP: "CBP";
        DMV: "DMV";
        OTHER: "OTHER";
    }>>;
    count: z.ZodNumber;
    color: z.ZodString;
}, z.core.$strip>;
export declare const vaultDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    agency: z.ZodEnum<{
        USCIS: "USCIS";
        EOIR: "EOIR";
        CBP: "CBP";
        DMV: "DMV";
        OTHER: "OTHER";
    }>;
    docType: z.ZodEnum<{
        OTHER: "OTHER";
        I94: "I94";
        I797C: "I797C";
        I765: "I765";
        EAD_CARD: "EAD_CARD";
        EOIR33: "EOIR33";
        NOTICE_OF_HEARING: "NOTICE_OF_HEARING";
        DRIVER_LICENSE: "DRIVER_LICENSE";
        PASSPORT: "PASSPORT";
    }>;
    capturedAt: z.ZodString;
    offlineAvailable: z.ZodBoolean;
    status: z.ZodEnum<{
        classified: "classified";
        needs_review: "needs_review";
        expired: "expired";
        processing: "processing";
    }>;
}, z.core.$strip>;
export declare const automationFlowSchema: z.ZodObject<{
    id: z.ZodString;
    filingType: z.ZodEnum<{
        EOIR33: "EOIR33";
        AR11: "AR11";
        CHANGE_OF_VENUE: "CHANGE_OF_VENUE";
        I765_RENEWAL: "I765_RENEWAL";
    }>;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<{
        needs_review: "needs_review";
        not_started: "not_started";
        draft: "draft";
        ready_to_sign: "ready_to_sign";
        exported: "exported";
    }>;
    progress: z.ZodNumber;
    legalReviewRequired: z.ZodBoolean;
}, z.core.$strip>;
export type Agency = z.infer<typeof agencySchema>;
export type StatusSeverity = z.infer<typeof statusSeveritySchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type FilingType = z.infer<typeof filingTypeSchema>;
export type AlertKind = z.infer<typeof alertKindSchema>;
export type CriticalAlert = z.infer<typeof criticalAlertSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type SmartFolder = z.infer<typeof smartFolderSchema>;
export type VaultDocument = z.infer<typeof vaultDocumentSchema>;
export type AutomationFlow = z.infer<typeof automationFlowSchema>;
