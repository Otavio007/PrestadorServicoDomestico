import { Tabs } from 'expo-router';
import { Calendar, MessageSquare, User } from 'lucide-react-native';

export default function ProviderLayout() {
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
                name="profile"
                options={{
                    title: 'Meu Perfil',
                    tabBarIcon: ({ color }) => <User color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="chats"
                options={{
                    title: 'Mensagens',
                    tabBarIcon: ({ color }) => <MessageSquare color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="schedule"
                options={{
                    title: 'Agenda',
                    tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
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
