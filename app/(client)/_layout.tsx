import { Tabs } from 'expo-router';
import { Home, MessageSquare, User } from 'lucide-react-native';
import { useUnread } from '../../context/UnreadContext';

export default function ClientLayout() {
    const { unreadCount } = useUnread();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#4F46E5',
                tabBarInactiveTintColor: '#6B7280',
                tabBarStyle: {
                    height: 95,
                    paddingBottom: 35,
                    paddingTop: 10,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Início',
                    tabBarIcon: ({ color }) => <Home color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="chats"
                options={{
                    title: 'Mensagens',
                    tabBarIcon: ({ color }) => <MessageSquare color={color} size={24} />,
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color }) => <User color={color} size={24} />,
                }}
            />
            {/* Hide other screens from the tab bar but keep them in the stack */}
            <Tabs.Screen
                name="provider-details/[id]"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="chat/[id]"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' } // Hide bar during chat
                }}
            />
        </Tabs>
    );
}
