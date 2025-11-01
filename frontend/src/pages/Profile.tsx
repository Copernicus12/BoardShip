import useAuth from "../state/auth"
import PageContainer from "../components/PageContainer"

export default function Profile() {
    const { user } = useAuth()

    return (
        <PageContainer>
            <h1 className="text-4xl font-bold text-neon mb-6">Profile</h1>

            <div className="bg-card rounded-2xl p-6 border border-accent shadow-lg">
                {user ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <img
                                src={`https://ui-avatars.com/api/?name=${user.username}&background=0b1220&color=00b4d8&size=128`}
                                alt="avatar"
                                className="w-24 h-24 rounded-full border-4 border-accent"
                            />
                            <div>
                                <h2 className="text-2xl font-semibold text-accent">{user.username}</h2>
                                <p className="text-muted">{user.email || 'No email provided'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted">Please login to view your profile.</p>
                )}
            </div>
        </PageContainer>
    )
}
