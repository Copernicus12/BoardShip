import React from 'react'

export default function PageContainer({ children, maxWidth = 'max-w-full' }: { children: React.ReactNode; maxWidth?: string }) {
    return (
        <div className={`w-full ${maxWidth} py-6 animate-fadeIn`}>
            {children}
        </div>
    )
}