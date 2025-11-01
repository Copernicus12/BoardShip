import React from 'react'

export default function PageContainer({ children, maxWidth = 'max-w-4xl' }: { children: React.ReactNode; maxWidth?: string }) {
    return (
        <div className={`w-full ${maxWidth} mx-auto`}>
            {children}
        </div>
    )
}
